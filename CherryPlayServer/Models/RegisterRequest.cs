using System.ComponentModel.DataAnnotations;
using CherryPlayServer.Core;

namespace CherryPlayServer.Models;

public record RegisterRequest(
    [Required]
    [EmailAddress]
    string Email,
    [Required]
    [MinLength(AuthConstants.MinPasswordLength)]
    string Password,
    [Required]
    string Name
);
